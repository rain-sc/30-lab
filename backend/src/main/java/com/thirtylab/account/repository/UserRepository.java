package com.thirtylab.account.repository;

import com.thirtylab.account.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {
    boolean existsUserByUsername(String username);

    Optional<User> findUserByUsername(String username);
}
