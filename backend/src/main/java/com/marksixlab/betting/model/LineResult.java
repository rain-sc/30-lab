package com.marksixlab.betting.model;

public record LineResult(int matched, boolean specialHit, PrizeTier tier, long prize) {
}
