package com.thirtylab.admin.bootstrap;

import com.thirtylab.admin.model.Admin;
import com.thirtylab.admin.model.AdminRole;
import com.thirtylab.admin.repository.AdminRepository;
import com.thirtylab.config.AdminProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class AdminBootstrapIntegrationTest {

    @Autowired
    private AdminRepository adminRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void clean() {
        adminRepository.deleteAll();
    }

    // 測試方法寫在這裡

    @Test
    void createsSuperAdminWhenNoneExists() {
        boolean created = bootstrap(" Boss ", "a-long-password-123").createFirstAdmin();

        assertThat(created).isTrue();
        Admin admin = adminRepository.findAdminByUsername("boss").orElseThrow();
        assertThat(admin.getRole()).isEqualTo(AdminRole.SUPER_ADMIN);
        assertThat(admin.isEnabled()).isTrue();
        assertThat(admin.getDisplayName()).isEqualTo("Boss");
        assertThat(passwordEncoder.matches("a-long-password-123", admin.getPasswordHash())).isTrue();
        assertThat(admin.getCreatedAt()).isNotNull();
    }

    @Test
    void doesNothingWhenAnAdminAlreadyExists() {
        bootstrap("boss", "a-long-password-123").createFirstAdmin();

        boolean created = bootstrap("other", "another-password-456").createFirstAdmin();

        assertThat(created).isFalse();
        assertThat(adminRepository.count()).isEqualTo(1);
        assertThat(adminRepository.findAdminByUsername("other")).isEmpty();
    }


    @Test
    void doesNothingWithoutSettingsOrWithShortPassword() {
        assertThat(bootstrap("", "a-long-password-123").createFirstAdmin()).isFalse();
        assertThat(bootstrap("boss", null).createFirstAdmin()).isFalse();
        assertThat(bootstrap("boss", "short").createFirstAdmin()).isFalse();
        assertThat(adminRepository.count()).isZero();
    }


    private AdminBootstrap bootstrap(String username, String password) {
        return new AdminBootstrap(new AdminProperties(username, password), passwordEncoder, adminRepository);
    }


}
