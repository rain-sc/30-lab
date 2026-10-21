package com.marksixlab.wallet.service;

import com.marksixlab.common.BusinessException;
import com.marksixlab.common.ErrorCode;
import com.marksixlab.config.WalletProperties;
import com.marksixlab.wallet.dto.ClaimDailyBonusResponse;
import com.marksixlab.wallet.dto.DailyBonusResponse;
import com.marksixlab.wallet.model.WalletTransactionType;
import com.marksixlab.wallet.repository.WalletTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
public class DailyBonusService {

    private static final int MAX_ATTEMPTS = 3;

    private final WalletService walletService;
    private final WalletTransactionRepository transactionRepository;
    private final WalletProperties walletProperties;

    public DailyBonusResponse status(String userId, Instant now){
        LocalDate today = today(now);
        boolean claimed = transactionRepository.existsByTypeAndRefId(WalletTransactionType.DAILY_BONUS, refId(userId,today));
        return new DailyBonusResponse(claimed, walletProperties.dailyBonus(),nextResetAt(today));
    }

    public ClaimDailyBonusResponse claim(String userId, Instant now){
        LocalDate today = today(now);
        for(int attempt =1; ; attempt++){
            try{
                return tryClaim(userId,today);
            }catch(DataIntegrityViolationException e){
                // 同時送出時，交易之間會互相衝突（WriteConflict）；重試時先查到已經領過，就會回傳 40904
                if(attempt == MAX_ATTEMPTS){
                    throw e;
                }
                pause(attempt);
            }
        }
    }

    private ClaimDailyBonusResponse tryClaim(String userId, LocalDate today){
        String refId = refId(userId, today);
        if(transactionRepository.existsByTypeAndRefId(WalletTransactionType.DAILY_BONUS, refId)){
            throw new BusinessException(ErrorCode.DAILY_BONUS_CLAIMED);
        }
        walletService.getOrOpen(userId);

        long amount = walletProperties.dailyBonus();
        try {
            long balance = walletService.credit(userId, amount, WalletTransactionType.DAILY_BONUS,refId);
            return new ClaimDailyBonusResponse(amount, balance,nextResetAt(today));
        }catch (DuplicateKeyException e){
            throw new BusinessException(ErrorCode.DAILY_BONUS_CLAIMED);
        }
    }

    private static LocalDate today(Instant now){
        return LocalDate.ofInstant(now, ZoneOffset.UTC);
    }

    private static Instant nextResetAt(LocalDate today){
        return today.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    private static String refId(String userId, LocalDate day){
        return userId + ":" + day;
    }

    private static void pause(int attempt){
        try{
            Thread.sleep(50L * attempt);
        }catch (InterruptedException e){
            Thread.currentThread().interrupt();
        }
    }
}
