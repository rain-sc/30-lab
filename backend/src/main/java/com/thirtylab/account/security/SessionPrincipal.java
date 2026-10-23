package com.thirtylab.account.security;

import java.security.Principal;

public record SessionPrincipal(String sessionId) implements Principal {

    @Override
    public String getName(){
        return sessionId;
    }
}
