package com.thirtylab.draw.dto;

import java.time.Instant;

public record DrawEvent(Type type, Instant serverTime, DrawResponse draw) {

    public  enum Type {
        OPENED,
        CLOSED,
        DRAWN,
        SETTLED
    }
}
