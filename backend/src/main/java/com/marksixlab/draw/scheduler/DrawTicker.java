package com.marksixlab.draw.scheduler;

import com.marksixlab.draw.service.DrawService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Slf4j
@Component
@RequiredArgsConstructor
public class DrawTicker {
    private final DrawService drawService;

    @Scheduled(fixedDelay = 1000)
    public void tick(){
        DrawService.TickResult result = drawService.tick(Instant.now());
        if(result.opened() != null){
            log.info("開放下注 {}", result.opened().getDrawNo());
        }
        result.closed().forEach(d -> log.info("停止下注 {}", d.getDrawNo()));
        result.drawn().forEach(d -> log.info("開獎 {} 號碼 {} 特別號 {}", d.getDrawNo(), d.getNumbers(), d.getSpecialNumber()));
    }
}
