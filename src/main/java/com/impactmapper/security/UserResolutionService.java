package com.impactmapper.security;

import com.impactmapper.entity.AppUser;
import com.impactmapper.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserResolutionService {

    private final AppUserRepository appUserRepository;
    private final java.util.concurrent.ConcurrentHashMap<UUID, AppUser> userCache = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.concurrent.ConcurrentHashMap<UUID, Long> userCacheTimestamp = new java.util.concurrent.ConcurrentHashMap<>();

    @Transactional
    public AppUser resolveOrProvisionUser(UUID supabaseUserId, String email, String displayName) {
        if (supabaseUserId == null) {
            throw new IllegalArgumentException("supabaseUserId cannot be null");
        }

        // Fast-path: Check short-lived memory cache (5 mins) to prevent DB queries on every HTTP request
        long now = System.currentTimeMillis();
        Long cachedTime = userCacheTimestamp.get(supabaseUserId);
        if (cachedTime != null && (now - cachedTime) < 300_000L) {
            AppUser cachedUser = userCache.get(supabaseUserId);
            if (cachedUser != null) {
                return cachedUser;
            }
        }

        AppUser resolvedUser = appUserRepository.findBySupabaseUserId(supabaseUserId)
                .map(user -> {
                    boolean changed = false;
                    if (email != null && !email.equalsIgnoreCase(user.getEmail())) {
                        user.setEmail(email);
                        changed = true;
                    }
                    if (displayName != null && !displayName.isBlank() && !displayName.equals(user.getDisplayName())) {
                        user.setDisplayName(displayName);
                        changed = true;
                    }
                    // Only update lastLoginAt if null or older than 15 minutes to avoid RowExclusiveLock contention across concurrent requests
                    if (user.getLastLoginAt() == null || user.getLastLoginAt().isBefore(LocalDateTime.now().minusMinutes(15))) {
                        user.setLastLoginAt(LocalDateTime.now());
                        changed = true;
                    }
                    return changed ? appUserRepository.save(user) : user;
                })
                .orElseGet(() -> {
                    log.info("Provisioning first-time local app_user for Supabase identity: {}", supabaseUserId);
                    AppUser newUser = AppUser.builder()
                            .supabaseUserId(supabaseUserId)
                            .email(email)
                            .displayName(displayName != null && !displayName.isBlank() ? displayName : (email != null ? email.split("@")[0] : "Developer"))
                            .lastLoginAt(LocalDateTime.now())
                            .build();
                    return appUserRepository.save(newUser);
                });

        if (userCache.size() > 50) {
            userCache.entrySet().removeIf(entry -> {
                Long ts = userCacheTimestamp.get(entry.getKey());
                return ts == null || (now - ts) >= 300_000L;
            });
            userCacheTimestamp.keySet().retainAll(userCache.keySet());
        }

        userCache.put(supabaseUserId, resolvedUser);
        userCacheTimestamp.put(supabaseUserId, now);
        return resolvedUser;
    }

    @Transactional(readOnly = true)
    public AppUser getUserBySupabaseId(UUID supabaseUserId) {
        return appUserRepository.findBySupabaseUserId(supabaseUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found for Supabase ID: " + supabaseUserId));
    }
}

