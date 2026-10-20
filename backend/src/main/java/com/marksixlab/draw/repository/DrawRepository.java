package com.marksixlab.draw.repository;

import com.marksixlab.draw.model.Draw;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface DrawRepository extends MongoRepository<Draw,String> {
    Optional<Draw> findByDrawNo(String drawNo);
}
