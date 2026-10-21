package com.marksixlab.betting.service;

import java.time.Instant;

import com.marksixlab.betting.dto.PlaceBetRequest;
import com.marksixlab.betting.dto.PlaceBetResponse;
import com.marksixlab.betting.dto.TicketResponse;
import com.marksixlab.betting.model.BetType;
import com.marksixlab.betting.model.Ticket;
import com.marksixlab.betting.model.TicketStatus;
import com.marksixlab.betting.repository.TicketRepository;
import com.marksixlab.common.BusinessException;
import com.marksixlab.common.ErrorCode;
import com.marksixlab.config.BettingProperties;
import com.marksixlab.config.GameProperties;
import com.marksixlab.draw.service.DrawService;
import com.marksixlab.wallet.model.WalletTransactionType;
import com.marksixlab.wallet.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
public class BettingService {

    private static final int MAX_ATTEMPTS = 3;

    private final TicketRepository ticketRepository;
    private final DrawService drawService;
    private final WalletService walletService;
    private final TransactionTemplate transactionTemplate;
    private final BettingProperties bettingProperties;
    private final GameProperties gameProperties;

    public PlaceBetResponse place(String userId, PlaceBetRequest req, Instant now) {
        for (int attempt = 1; ; attempt++) {
            try {
                return tryPlace(userId, req, now);
            } catch (DataIntegrityViolationException e) {
                if (attempt == MAX_ATTEMPTS) {
                    throw e;
                }
                pause(attempt);
            }
        }
    }

    private PlaceBetResponse tryPlace(String userId, PlaceBetRequest req, Instant now) {
        var existing = ticketRepository.findByUserIdAndIdempotencyKey(userId, req.idempotencyKey());
        if (existing.isPresent()) {
            return withBalance(existing.get(), userId);
        }

        if (req.lines().size() > bettingProperties.maxLines()) {
            throw new BusinessException(ErrorCode.TOO_MANY_LINES);
        }
        drawService.requireOpenForBetting(req.drawNo(), now);
        walletService.getOrOpen(userId);

        Ticket ticket = new Ticket();
        ticket.setUserId(userId);
        ticket.setDrawNo(req.drawNo());
        ticket.setBetType(BetType.SINGLE);
        ticket.setLines(req.lines().stream().map(line -> line.stream().sorted().toList()).toList());
        ticket.setCost(req.lines().size() * gameProperties.pointsPerBet());
        ticket.setStatus(TicketStatus.PENDING);
        ticket.setIdempotencyKey(req.idempotencyKey());

        Long balance = transactionTemplate.execute(status -> {
            Ticket saved = ticketRepository.insert(ticket);
            return walletService.debit(userId, saved.getCost(), WalletTransactionType.BET, saved.getId());
        });
        return new PlaceBetResponse(TicketResponse.from(ticket), balance);
    }

    private PlaceBetResponse withBalance(Ticket ticket, String userId) {
        return new PlaceBetResponse(TicketResponse.from(ticket), walletService.balance(userId).balance());
    }

    private static void pause(int attempt) {
        try {
            Thread.sleep(50L * attempt);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
