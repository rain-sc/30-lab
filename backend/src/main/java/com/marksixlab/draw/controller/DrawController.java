package com.marksixlab.draw.controller;

import com.marksixlab.common.Result;
import com.marksixlab.draw.dto.CurrentDrawResponse;
import com.marksixlab.draw.service.DrawService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@RestController
@RequestMapping("/api/draws")
@RequiredArgsConstructor
@Tag(name = "Draw", description = "期數、開獎結果")
public class DrawController {

    private final DrawService drawService;

    @GetMapping("/current")
    @Operation(summary = "目前期數和最近一期的開獎結果 (不用登入)")
    public Result<CurrentDrawResponse> current(){
        return Result.ok(drawService.current(Instant.now().truncatedTo(ChronoUnit.MILLIS)));
    }
}
