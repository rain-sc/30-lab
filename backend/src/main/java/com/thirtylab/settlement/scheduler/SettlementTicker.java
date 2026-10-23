package com.thirtylab.settlement.scheduler;

import com.thirtylab.draw.dto.DrawEvent;
import com.thirtylab.draw.dto.DrawResponse;
import com.thirtylab.draw.model.Draw;
import com.thirtylab.settlement.service.SettlementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class SettlementTicker {

    private static final String TOPIC = "/topic/draws";

    private final SettlementService settlementService;
    private final SimpMessagingTemplate messagingTemplate;

    @Scheduled(fixedDelay =  1000)
    public void tick(){
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        while(true){
            Optional<Draw> settled = settlementService.settleNext(now);
            if(settled.isEmpty()){
                return;
            }
            Draw draw = settled.get();
            log.info("SETTLED {} pool={} jackpotWinners={} rollover={}",
                    draw.getDrawNo(), draw.getPoolAmount(), draw.getJackpotWinners(), draw.getJackpotRollover());
            messagingTemplate.convertAndSend(TOPIC,new DrawEvent(DrawEvent.Type.SETTLED, now, DrawResponse.from(draw)));
        }
    }
}
