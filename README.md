# LogiPulse

High-throughput fleet dispatch API — Fastify backend + OpenTofu-provisioned AWS infrastructure. Built as a portfolio demo project.

## Repo layout

```
logipulse/
├── server/    # Fastify backend (see server/README.md)
├── infra/     # OpenTofu IaC (AWS VPC, ECS Fargate, RDS, ALB)
└── docs/      # Architecture notes and implementation plan
```

See `docs/intro.md` for the full spec and `docs/implementation-plan.md` for the phased build plan.

## Status

Work in progress — see `docs/implementation-plan.md` for current phase.
