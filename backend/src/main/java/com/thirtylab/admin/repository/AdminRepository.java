package com.thirtylab.admin.repository;

import com.thirtylab.admin.model.Admin;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface AdminRepository extends MongoRepository<Admin,String> {

    Optional<Admin> findAdminByUsername(String username);
}
