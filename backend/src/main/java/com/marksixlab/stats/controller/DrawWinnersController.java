package com.marksixlab.stats.controller;

import com.marksixlab.common.Result;
import com.marksixlab.stats.dto.DrawWinnersResponse;
import com.marksixlab.stats.service.DrawWinnersService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@Tag(name = "Draw", description = "期數、開獎結果")
public class DrawWinnersController {

    private final DrawWinnersService drawWinnersService;

    @GetMapping("/api/draws/{drawNo}/winners")
    @Operation(summary = "這期的中獎名單：獎金由高到低，最多 50 人（不用登入；有登入會標出自己）")
    public Result<DrawWinnersResponse> winners(@PathVariable String drawNo, @AuthenticationPrincipal String userId) {
        return Result.ok(drawWinnersService.winners(drawNo, userId));
    }
}
