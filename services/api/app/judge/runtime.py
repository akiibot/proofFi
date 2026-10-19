"""Explicit certificate runtime; never creates or passes an EVM signing key."""

import json
import os
from dataclasses import dataclass

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from pydantic import SecretStr

from app.core.errors import DomainError
from app.models.contracts import ErrorCode
from app.planner.provider import PlannerSettings, vertex_proposal
from app.verifier.service import RuntimeSettings


@dataclass(frozen=True)
class VerificationRuntime:
    settings: RuntimeSettings
    key_id: str
    public: bytes

    def public_keys(self):
        return {self.key_id: Ed25519PublicKey.from_public_bytes(self.public)}


@dataclass(frozen=True)
class GuestRuntime:
    verification: VerificationRuntime | None
    proposal_provider: object
    chain_settings: object = None
    read_settings: object = None


def guest_runtime(registry, key):
    private = Ed25519PrivateKey.generate()
    seed = private.private_bytes(
        serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption()
    ).hex()
    public = private.public_key().public_bytes(
        serialization.Encoding.Raw, serialization.PublicFormat.Raw
    )
    key_id = "judge-" + key[:32]
    # Select only public RPC/transaction ceilings; never load the operator verifier key.
    verification = None
    chain = None
    read = None
    try:
        from app.optimizer.chain import ChainSettings

        chain = ChainSettings()
        from app.execution.status import ReadSettings

        read = ReadSettings(
            _env_file=None,
            rpc_url=chain.rpc_url,
            wallet_address=chain.wallet_address,
            test_token_address=chain.test_token_address,
        )
        from app.verifier.service import TransactionConfiguration

        # Fee config has public chain fields only. Missing fields disable verification honestly.
        raw = json.loads(os.environ.get("VERIFIER_TRANSACTION_CONFIG_JSON", "{}"))
        config = TransactionConfiguration.model_validate(raw)
        settings = RuntimeSettings(
            _env_file=None,
            verifier_private_key=SecretStr(seed),
            verifier_key_id=key_id,
            verifier_transaction_config_json=SecretStr(config.model_dump_json()),
            rpc_url=chain.rpc_url,
        )
        verification = VerificationRuntime(settings, key_id, public)
    except Exception:
        pass

    def proposal(goal, context, ignored_settings):
        registry.reserve_provider(key)
        try:
            settings = PlannerSettings(planner_mode="live_llm", demo_mode=False)
            # The provider receives only OS/runtime plumbing, never application secrets.
            environment = {
                k: v
                for k, v in os.environ.items()
                if k
                in {
                    "PATH",
                    "SYSTEMROOT",
                    "WINDIR",
                    "TEMP",
                    "TMP",
                    "TMPDIR",
                    "LANG",
                    "LC_ALL",
                    "SSL_CERT_FILE",
                    "SSL_CERT_DIR",
                    "PYTHONIOENCODING",
                    "PYTHONUTF8",
                }
            }
            if settings.planner_provider != "vertex_express":
                raise DomainError(
                    ErrorCode.UNAVAILABLE, "Judge live planner requires configured express provider"
                )
            return vertex_proposal(goal, context, settings, worker_environment=environment)
        except DomainError:
            raise
        except Exception:
            raise DomainError(ErrorCode.UNAVAILABLE, "Judge live planner unavailable") from None

    return GuestRuntime(verification, proposal, chain, read)


def verification_for(request):
    if getattr(request.app.state, "judge_scope", None) is None:
        return None
    runtime = request.app.state.judge_runtime
    if runtime is None or runtime.verification is None:
        raise DomainError(ErrorCode.UNAVAILABLE, "Judge verification configuration unavailable")
    return runtime.verification


def chain_for(request):
    if getattr(request.app.state, "judge_scope", None) is None:
        return None
    runtime = request.app.state.judge_runtime
    if runtime is None or runtime.chain_settings is None:
        raise DomainError(ErrorCode.UNAVAILABLE, "Judge chain configuration unavailable")
    return runtime.chain_settings
