package com.marksixlab.config;

import com.marksixlab.account.security.JwtCookieFilter;
import com.marksixlab.account.service.JwtService;
import com.marksixlab.account.service.SessionService;
import com.marksixlab.common.BusinessException;
import com.marksixlab.common.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.servlet.HandlerExceptionResolver;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtService jwtService,
            SessionService sessionService,
            AuthProperties authProperties,
            @Qualifier("handlerExceptionResolver") HandlerExceptionResolver resolver) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .anonymous(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/register", "/api/auth/login", "/api/auth/logout").permitAll()
                        .requestMatchers("/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        .requestMatchers("/actuator/health", "/error", "/ws").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/draws/**", "/api/jackpot", "/api/leaderboard").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) ->
                                resolver.resolveException(req, res, null, new BusinessException(authErrorOf(req))))
                        .accessDeniedHandler((req, res, ex) ->
                                resolver.resolveException(req, res, null, new BusinessException(ErrorCode.FORBIDDEN))))
                .addFilterBefore(
                        new JwtCookieFilter(jwtService, sessionService, authProperties.cookieName()),
                        UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    private static ErrorCode authErrorOf(HttpServletRequest request) {
        return request.getAttribute(JwtCookieFilter.AUTH_ERROR_ATTR) instanceof  ErrorCode code ? code : ErrorCode.UNAUTHORIZED;
    }
}
