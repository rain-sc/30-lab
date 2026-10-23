package com.marksixlab.betting.validation;

import com.marksixlab.config.GameProperties;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import lombok.RequiredArgsConstructor;

// Spring 會負責建立這個 class，所以可以注入設定
@RequiredArgsConstructor
public class BallNumberValidator implements ConstraintValidator<BallNumber, Integer> {

    private final GameProperties gameProperties;

    @Override
    public boolean isValid(Integer value, ConstraintValidatorContext context) {
        // null 交給 @NotNull 處理，這裡只檢查範圍
        return value == null || (value >= 1 && value <= gameProperties.maxNumber());
    }
}
