package com.marksixlab.account.security;

import java.io.IOException;
import java.util.List;

import com.marksixlab.account.service.JwtService;
import com.marksixlab.account.service.SessionService;
import com.marksixlab.common.ErrorCode;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.WebUtils;
@RequiredArgsConstructor
public class JwtCookieFilter extends OncePerRequestFilter {
    public static final String AUTH_ERROR_ATTR = "authError";
    public static final String SESSION_ID_ATTR = "sessionId";

    private final JwtService jwtService;
    private final SessionService sessionService;
    private final String cookieName;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
    throws ServletException, IOException{
        Cookie cookie = WebUtils.getCookie(request,cookieName);
        if(cookie != null){
            authenticate(request,cookie.getValue());
        }
        chain.doFilter(request,response);
    }

    private void authenticate(HttpServletRequest request, String token) {
         Claims claims;
         try{
          claims = jwtService.parse(token);
         }catch(JwtException | IllegalArgumentException  e){
             return;
         }

         String userId = claims.getSubject();
         String current = sessionService.current(userId);
         if(current == null){
             return;
         }
         if(!current.equals(claims.getId())){
             request.setAttribute(AUTH_ERROR_ATTR,ErrorCode.SESSION_REPLACED);
             return;
         }

         var auth = new UsernamePasswordAuthenticationToken(userId,null,List.of());
         SecurityContextHolder.getContext().setAuthentication(auth);
         request.setAttribute(SESSION_ID_ATTR,current);
    }
}
