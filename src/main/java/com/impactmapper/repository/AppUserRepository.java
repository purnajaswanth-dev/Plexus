package com.impactmapper.repository;

import com.impactmapper.entity.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {
    Optional<AppUser> findBySupabaseUserId(UUID supabaseUserId);
    Optional<AppUser> findByEmail(String email);
}

