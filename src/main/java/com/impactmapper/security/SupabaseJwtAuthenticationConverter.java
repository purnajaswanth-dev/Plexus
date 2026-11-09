package com.impactmapper.security;

import com.impactmapper.entity.AppUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class SupabaseJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final UserResolutionService userResolutionService;

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        String sub = jwt.getSubject();
        if (sub == null || sub.isBlank()) {
            throw new IllegalArgumentException("JWT missing subject ('sub') claim");
        }

        UUID supabaseUserId;
        try {
            supabaseUserId = UUID.fromString(sub);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("JWT subject claim is not a valid UUID: " + sub);
        }

        String email = jwt.getClaimAsString("email");
        String displayName = null;

        Map<String, Object> userMetadata = jwt.getClaim("user_metadata");
        if (userMetadata != null) {
            Object nameObj = userMetadata.get("full_name");
            if (nameObj == null) nameObj = userMetadata.get("name");
            if (nameObj != null) displayName = nameObj.toString();
        }

        AppUser appUser = userResolutionService.resolveOrProvisionUser(supabaseUserId, email, displayName);

        UserPrincipal principal = UserPrincipal.builder()
                .appUserId(appUser.getId())
                .supabaseUserId(supabaseUserId)
                .email(appUser.getEmail())
                .displayName(appUser.getDisplayName())
                .authorities(Collections.singletonList(new SimpleGrantedAuthority("ROLE_USER")))
                .build();

        return new UsernamePasswordAuthenticationToken(principal, jwt, principal.getAuthorities());
    }
}

