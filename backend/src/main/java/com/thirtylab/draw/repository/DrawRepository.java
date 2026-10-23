package com.thirtylab.draw.repository;

import com.thirtylab.draw.model.Draw;
import com.thirtylab.draw.model.DrawStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DrawRepository extends MongoRepository<Draw,String> {
    Optional<Draw> findByDrawNo(String drawNo);

    Optional<Draw> findFirstByStatusInOrderByDrawAtDesc(Collection<DrawStatus> statuses);

    Page<Draw> findByStatusIn(Collection<DrawStatus> statuses, Pageable pageable);

    Optional<Draw> findFirstByStatusOrderByDrawAtAsc(DrawStatus status);

    Optional<Draw> findFirstByStatusAndDrawAtBeforeOrderByDrawAtDesc(DrawStatus status, Instant drawAt);

    long countByStatusIn(Collection<DrawStatus> statuses);

    List<Draw> findByStatusAndPrizeSummaryIsNull(DrawStatus status);


}
