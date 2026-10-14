package com.marksixlab.account.repository;

import com.marksixlab.account.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {
    boolean existsUserByUsername(String username);

    Optional<User> findUserByUsername(String username);
}
