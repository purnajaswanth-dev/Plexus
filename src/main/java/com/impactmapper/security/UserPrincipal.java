package com.impactmapper.security;

import lombok.Builder;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.io.Serializable;
import java.util.Collection;
import java.util.Collections;
import java.util.UUID;

@Getter
@Builder
public class UserPrincipal implements UserDetails, Serializable {

    private final UUID appUserId;
    private final UUID supabaseUserId;
    private final String email;
    private final String displayName;

    @Builder.Default
    private final Collection<? extends GrantedAuthority> authorities = Collections.emptyList();

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return null; // External identity provider (Supabase Auth) manages credentials
    }

    @Override
    public String getUsername() {
        return email != null ? email : (supabaseUserId != null ? supabaseUserId.toString() : "");
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}

