package com.marksixlab.settlement.scheduler;

import com.marksixlab.settlement.service.SettlementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

// 啟動時補算舊期數的獎級統計；跟排程用同一個開關，測試時不會執行
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.scheduling", name = "enabled", havingValue = "true", matchIfMissing = true)
public class PrizeSummaryBackfill implements ApplicationRunner {

    private final SettlementService settlementService;

    @Override
    public void run(ApplicationArguments args) {
        int filled = settlementService.backfillPrizeSummaries();
        if (filled > 0) {
            log.info("補算獎級統計：{} 期", filled);
        }
    }
}
