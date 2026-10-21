package com.marksixlab.betting.model;

public enum PrizeTier {
    FIRST,
    SECOND,
    THIRD,
    FOURTH,
    FIFTH,
    SIXTH,
    SEVENTH;


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