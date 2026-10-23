package com.thirtylab.draw.service;

import java.time.Instant;

public record DrawSlot(String drawNo, Instant openAt, Instant closeAt,Instant drawAt) {
}
