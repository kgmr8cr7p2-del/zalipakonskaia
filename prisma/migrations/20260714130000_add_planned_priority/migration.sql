-- Add the planned-work priority without changing existing task values.
ALTER TYPE "Priority" ADD VALUE IF NOT EXISTS 'PLANNED' AFTER 'LOW';
