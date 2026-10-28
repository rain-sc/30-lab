package com.thirtylab.admin.bootstrap;

import com.thirtylab.admin.model.Admin;
import com.thirtylab.admin.model.AdminRole;
import com.thirtylab.admin.repository.AdminRepository;
import com.thirtylab.config.AdminProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Locale;

@Slf4j
@Component
@RequiredArgsConstructor
public class AdminBootstrap implements ApplicationRunner {

    static final int MIN_PASSWORD_LENGTH = 12;
    private final AdminProperties adminProperties;
    private final PasswordEncoder passwordEncoder;
    private final AdminRepository adminRepository;

    @Override
    public void run(ApplicationArguments args){
        createFirstAdmin();
    }

    public boolean createFirstAdmin(){
        String username = adminProperties.bootstrapUsername();
        String password = adminProperties.bootstrapPassword();

        if(adminRepository.count() > 0 || isBlank(username) || isBlank(password)){
            return false;
        }
        if(password.length() < MIN_PASSWORD_LENGTH){
            log.warn("ADMIN_BOOTSTRAP_PASSWORD 少於 {} 個字元，不建立第一個管理員", MIN_PASSWORD_LENGTH);
            return false;
        }
        Admin admin =  new Admin();
        admin.setUsername(username.strip().toLowerCase(Locale.ROOT));
        admin.setDisplayName(username.strip());
        admin.setPasswordHash(passwordEncoder.encode(password));
        admin.setRole(AdminRole.SUPER_ADMIN);
        admin.setEnabled(true);
        try{
            adminRepository.insert(admin);
        } catch (DuplicateKeyException e) {
            return false;
        }
        log.info("已建立第一個管理員 {}（SUPER_ADMIN）", admin.getUsername());
        return true;
    }

    private static boolean isBlank(String s){
        return s == null || s.isBlank();
    }
}
