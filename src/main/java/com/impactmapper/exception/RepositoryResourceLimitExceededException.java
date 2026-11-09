package com.impactmapper.exception;

import lombok.Getter;

/**
 * Thrown when a repository exceeds Render Free tier operational resource bounds
 * (source file count, compressed archive size, single file size, or extracted bytes).
 */
@Getter
public class RepositoryResourceLimitExceededException extends RuntimeException {

    private final String limitType;
    private final long actualValue;
    private final long limitValue;
    private final String unit;

    public RepositoryResourceLimitExceededException(
            String limitType,
            long actualValue,
            long limitValue,
            String unit,
            String message) {
        super(message);
        this.limitType = limitType;
        this.actualValue = actualValue;
        this.limitValue = limitValue;
        this.unit = unit;
    }
}
