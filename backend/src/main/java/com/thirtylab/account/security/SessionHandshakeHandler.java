package com.thirtylab.account.security;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.security.Principal;
import java.util.Map;

public class SessionHandshakeHandler extends DefaultHandshakeHandler {
    @Override
    protected Principal determineUser(ServerHttpRequest request, WebSocketHandler wsHandler,
                                      Map<String, Object> attributes) {
        if (request instanceof ServletServerHttpRequest servletRequest
                && servletRequest.getServletRequest().getAttribute(JwtCookieFilter.SESSION_ID_ATTR) instanceof String sessionId) {
            return new SessionPrincipal(sessionId);
        }
        return null;
    }
}
