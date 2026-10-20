package com.marksixlab.draw.model;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;


@Getter
@Setter
@NoArgsConstructor
@Document("draws")
public class Draw {
    @Id
    private String id;

    @Indexed(unique = true)
    private String drawNo;

    private DrawStatus status;

    private Instant openAt;

    private Instant drawAt;

    private Instant closeAt;

    private List<Integer> numbers;

    private Integer specialNumber;

    private Instant drawnAt;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

}
