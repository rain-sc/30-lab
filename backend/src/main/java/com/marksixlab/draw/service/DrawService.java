package com.marksixlab.draw.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.marksixlab.common.BusinessException;
import com.marksixlab.common.ErrorCode;
import com.marksixlab.common.PageResult;
import com.marksixlab.common.Pagination;
import com.marksixlab.draw.dto.CurrentDrawResponse;
import com.marksixlab.draw.dto.DrawResponse;
import com.marksixlab.draw.model.Draw;
import com.marksixlab.draw.model.DrawStatus;
import com.marksixlab.draw.repository.DrawRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DrawService {

    private final DrawRepository drawRepository;
    private final MongoTemplate mongoTemplate;
    private final DrawSchedule drawSchedule;
    private final NumberGenerator numberGenerator;

    public record TickResult(Draw opened, List<Draw> closed, List<Draw> drawn) {
    }

    public TickResult tick(Instant now) {
        Draw opened = openCurrent(now);
        List<Draw> closed = closeDue(now);
        List<Draw> drawn = drawDue(now);
        return new TickResult(opened, closed, drawn);
    }

    public void requireOpenForBetting(String drawNo, Instant now){
        DrawSlot slot = drawSchedule.slotAt(now);
        if(!slot.drawNo().equals(drawNo) || !now.isBefore(slot.closeAt())){
            throw new BusinessException(ErrorCode.BETTING_CLOSED);
        }
    }

    private Draw openCurrent(Instant now) {
        DrawSlot slot = drawSchedule.slotAt(now);
        if (drawRepository.findByDrawNo(slot.drawNo()).isPresent()) {
            return null;
        }

        Draw draw = new Draw();
        draw.setDrawNo(slot.drawNo());
        draw.setStatus(DrawStatus.OPEN);
        draw.setOpenAt(slot.openAt());
        draw.setCloseAt(slot.closeAt());
        draw.setDrawAt(slot.drawAt());
        try {
            return drawRepository.save(draw);
        } catch (DuplicateKeyException e) {
            return null;
        }
    }

    private List<Draw> closeDue(Instant now) {
        Query query = Query.query(Criteria.where("status").is(DrawStatus.OPEN).and("closeAt").lte(now));
        Update update = new Update()
                .set("status", DrawStatus.CLOSED)
                .set("updatedAt", now);

        List<Draw> closed = new ArrayList<>();
        while (true) {
            Draw draw = mongoTemplate.findAndModify(query, update, FindAndModifyOptions.options().returnNew(true), Draw.class);
            if (draw == null) {
                return closed;
            }
            closed.add(draw);
        }
    }

    private List<Draw> drawDue(Instant now) {
        Query query = Query.query(Criteria.where("status").is(DrawStatus.CLOSED).and("drawAt").lte(now))
                .with(Sort.by("drawAt"));

        List<Draw> drawn = new ArrayList<>();
        while (true) {
            DrawnNumbers result = numberGenerator.draw();
            Update update = new Update()
                    .set("status", DrawStatus.DRAWN)
                    .set("numbers", result.numbers())
                    .set("specialNumber", result.specialNumber())
                    .set("drawnAt", now)
                    .set("updatedAt", now);
            Draw draw = mongoTemplate.findAndModify(query, update, FindAndModifyOptions.options().returnNew(true), Draw.class);
            if (draw == null) {
                return drawn;
            }
            drawn.add(draw);
        }
    }

    public Optional<Draw> nextToSettle() {
        return drawRepository.findFirstByStatusOrderByDrawAtAsc(DrawStatus.DRAWN);
    }

    public long previousRollover(Draw draw) {
        return drawRepository.findFirstByStatusAndDrawAtBeforeOrderByDrawAtDesc(DrawStatus.SETTLED, draw.getDrawAt())
                .map(Draw::getJackpotRollover)
                .orElse(0L);
    }

    public Draw markSettled(String drawNo, long poolAmount, int jackpotWinners, long jackpotRollover, Instant now) {
        Query query = Query.query(Criteria.where("drawNo").is(drawNo).and("status").is(DrawStatus.DRAWN));
        Update update = new Update()
                .set("status", DrawStatus.SETTLED)
                .set("poolAmount", poolAmount)
                .set("jackpotWinners", jackpotWinners)
                .set("jackpotRollover", jackpotRollover)
                .set("settledAt", now)
                .set("updatedAt", now);
        return mongoTemplate.findAndModify(query, update, FindAndModifyOptions.options().returnNew(true), Draw.class);
    }


    public CurrentDrawResponse current(Instant now){
        DrawSlot slot = drawSchedule.slotAt(now);
        DrawResponse current = drawRepository.findByDrawNo(slot.drawNo())
                .map(DrawResponse::from)
                .orElseGet(() -> new DrawResponse(slot.drawNo(),DrawStatus.OPEN,slot.openAt(),slot.closeAt(),slot.drawAt(),null,null));
        DrawResponse previous = drawRepository
                .findFirstByStatusInOrderByDrawAtDesc(List.of(DrawStatus.DRAWN,DrawStatus.SETTLED))
                .map(DrawResponse::from)
                .orElse(null);
        return new CurrentDrawResponse(now,current,previous);
    }

    public PageResult<DrawResponse> history(int page, int size){
        Pageable pageable = Pagination.of(page, size, Sort.by(Sort.Direction.DESC, "drawAt"));
        Page<DrawResponse> result = drawRepository
                .findByStatusIn(List.of(DrawStatus.DRAWN, DrawStatus.SETTLED), pageable)
                .map(DrawResponse::from);
        return PageResult.of(result);
    }
}
