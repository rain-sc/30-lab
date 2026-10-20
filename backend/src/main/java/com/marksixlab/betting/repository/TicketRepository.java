package com.marksixlab.betting.repository;

import com.marksixlab.betting.model.Ticket;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface TicketRepository extends MongoRepository<Ticket, String> {

    Optional<Ticket> findByUserIdAndIdempotencyKey(String userId, String idempotencyKey);

    Page<Ticket> findByUserId(String userId, Pageable pageable);
}
