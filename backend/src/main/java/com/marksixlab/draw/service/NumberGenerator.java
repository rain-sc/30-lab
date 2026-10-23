package com.marksixlab.draw.service;

import com.marksixlab.config.GameProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Component
@RequiredArgsConstructor
public class NumberGenerator {

    private final GameProperties gameProperties;

    private final SecureRandom random = new SecureRandom();

    public DrawnNumbers draw() {
        int maxNumber = gameProperties.maxNumber();
        List<Integer> pool = new ArrayList<>(maxNumber);
        for (int n = 1; n <= maxNumber; n++) {
            pool.add(n);
        }
        Collections.shuffle(pool, random);
        return new DrawnNumbers(List.copyOf(pool.subList(0, 6)), pool.get(6));
    }
}
