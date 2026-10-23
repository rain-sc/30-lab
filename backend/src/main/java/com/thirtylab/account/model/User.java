package com.thirtylab.account.model;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@Document("users")
public class User {
  @Id
  private  String id;

  @Indexed(unique = true)
  private String username;

  private String passwordHash;

  private String nickname;

  @CreatedDate
  private Instant  createdAt;

  @LastModifiedDate
  private Instant  updatedAt;


}
