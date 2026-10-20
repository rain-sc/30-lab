package com.marksixlab.draw.repository;

import com.marksixlab.draw.model.Draw;
import com.marksixlab.draw.model.DrawStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Collection;
import java.util.Optional;

public interface DrawRepository extends MongoRepository<Draw,String> {
    Optional<Draw> findByDrawNo(String drawNo);

    Optional<Draw> findFirstByStatusInOrderByDrawAtDesc(Collection<DrawStatus> statuses);

    Page<Draw> findByStatusIn(Collection<DrawStatus> statuses, Pageable pageable);
}
