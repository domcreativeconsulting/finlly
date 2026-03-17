-- Migration: 04.2.4 — add 'pendente' value to status_assinante enum
ALTER TYPE "status_assinante" ADD VALUE IF NOT EXISTS 'pendente';
