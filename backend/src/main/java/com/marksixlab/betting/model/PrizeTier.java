package com.marksixlab.betting.model;

public enum PrizeTier {
    FIRST(6, false),
    SECOND(5, true),
    THIRD(5, false),
    FOURTH(4, true),
    FIFTH(4, false),
    SIXTH(3, true),
    SEVENTH(3, false);

    private final int matched;
    private final boolean specialHit;

    PrizeTier(int matched, boolean specialHit) {
        this.matched = matched;
        this.specialHit = specialHit;
    }

    // 中獎條件：中幾個正碼、要不要中特別號碼
    public int matched() {
        return matched;
    }

    public boolean specialHit() {
        return specialHit;
    }

    public static PrizeTier of(int matched,boolean specialHit){
        return switch(matched){
            case 6 -> FIRST;
            case 5 -> specialHit ? SECOND : THIRD;
            case 4 -> specialHit ? FOURTH : FIFTH;
            case 3 -> specialHit ? SIXTH : SEVENTH;
            default -> null;
        };
    }
}
