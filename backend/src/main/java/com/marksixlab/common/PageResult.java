package com.marksixlab.common;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.data.domain.Page;

import java.util.List;

public record PageResult<T>(
        @Schema(requiredMode = REQUIRED)
        List<T> list,

        @Schema(description = "總筆數", requiredMode = REQUIRED)
        long total,

        @Schema(description = "第幾頁,從 1 開始", requiredMode = REQUIRED)
        int page,

        @Schema(description = "每頁筆數", requiredMode = REQUIRED)
        int size
) {
    public static <T> PageResult<T> of(Page<T> page){
        return new PageResult<>(page.getContent(),page.getTotalElements(),page.getNumber() + 1, page.getSize());
    }
}
