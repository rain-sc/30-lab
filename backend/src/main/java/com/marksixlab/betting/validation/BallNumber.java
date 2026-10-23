package com.marksixlab.betting.validation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

// 號碼必須在 1 ~ app.game.max-number 之間（上限從設定讀，所以不能用 @Max）
@Documented
@Target({ElementType.TYPE_USE, ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = BallNumberValidator.class)
public @interface BallNumber {

    String message() default "號碼超出範圍";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
