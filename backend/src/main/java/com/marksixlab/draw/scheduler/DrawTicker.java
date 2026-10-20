package com.marksixlab.draw.scheduler;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import com.marksixlab.draw.dto.DrawEvent;
import com.marksixlab.draw.dto.DrawResponse;
import com.marksixlab.draw.model.Draw;
import com.marksixlab.draw.service.DrawService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DrawTicker {
    private static final String TOPIC = "/topic/draws";

    private final DrawService drawService;
    private final SimpMessagingTemplate messagingTemplate;

    @Scheduled(fixedDelay = 1000)
    public void tick(){
       Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
       DrawService.TickResult result = drawService.tick(now);

       if(result.opened() != null){
           publish(DrawEvent.Type.OPENED,result.opened(),now);
       }
       result.closed().forEach(d -> publish(DrawEvent.Type.CLOSED,d,now));
       result.drawn().forEach(d -> publish(DrawEvent.Type.DRAWN,d,now));
    }

    private void publish(DrawEvent.Type type,Draw draw, Instant now){
        log.info("{} {}", type, draw.getDrawNo());
        messagingTemplate.convertAndSend(TOPIC,new DrawEvent(type, now, DrawResponse.from(draw)));
    }
}
