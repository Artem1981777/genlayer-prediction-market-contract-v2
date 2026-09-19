#!/usr/bin/env python3
"""Deterministic lifecycle checks for PredictionMarketResolver.

This is not a replacement for a Bradbury deployment. It isolates the contract's
lifecycle guards and consensus outcome handling with deterministic web/LLM mocks.
"""
import json
from pathlib import Path

class Return:
    def __init__(self, calldata): self.calldata = calldata

class Decorator:
    def __call__(self, fn): return fn
    @property
    def payable(self): return self

class Public:
    view = Decorator()
    write = Decorator()

class Evm:
    def contract_interface(self, cls): return cls

class Eq:
    def prompt_comparative(self, fn, _criterion): return fn()

class Web:
    def render(self, _url, mode="text"):
        return "Ethereum completed The Merge and uses Proof-of-Stake."

class Nondet:
    def __init__(self, outcomes=None):
        self.web = Web()
        self.outcomes = list(outcomes or ["UNRESOLVED"])
    def exec_prompt(self, _prompt):
        outcome = self.outcomes.pop(0) if self.outcomes else "UNRESOLVED"
        return json.dumps({"outcome": outcome})

class Message:
    sender_address = "0xCREATOR"
    value = 0

class Gl:
    def __init__(self):
        self.public = Public(); self.evm = Evm(); self.eq_principle = Eq()
        self.nondet = Nondet(); self.message = Message()
        self.Contract = object

GL = Gl()
source = Path(__file__).parent.joinpath("contracts/prediction_market.py").read_text()
source = source.replace("from genlayer import *", "gl = GL", 1)
namespace = {"GL": GL, "gl": GL, "__name__": "prediction_market_under_test"}
exec(compile(source, "contracts/prediction_market.py", "exec"), namespace)
Contract = namespace["PredictionMarketResolver"]

checks = []
def check(condition, label):
    checks.append(bool(condition))
    print(("PASS" if condition else "FAIL") + " - " + label)

def call_as(contract, sender, method, *args):
    GL.message.sender_address = sender
    try:
        getattr(contract, method)(*args)
        return None
    except Exception as exc:
        return exc

c = Contract("Has Ethereum completed The Merge?", "YES if the source says it completed The Merge; otherwise UNRESOLVED.", "https://example.com/source", "", "", "sim-1")

err = call_as(c, "0xOTHER", "resolve")
check(err is not None and "creator" in str(err).lower(), "non-creator resolve is rejected")

err = call_as(c, "0xCREATOR", "add_source", "https://example.com/source")
check(err is not None and "duplicate" in str(err).lower(), "duplicate source is rejected")

err = call_as(c, "0xCREATOR", "resolve")
state = c.get_state()
check(err is None, "creator resolve executes")
check(state["outcome"] == "UNRESOLVED", "mock consensus returns UNRESOLVED")
check(state["status"] == "open", "UNRESOLVED leaves market open")

err = call_as(c, "0xCREATOR", "resolve")
state = c.get_state()
check(err is None, "creator can retry resolve after UNRESOLVED")
check(state["status"] == "open", "retryable UNRESOLVED remains open")

err = call_as(c, "0xOTHER", "void")
check(err is not None and "creator" in str(err).lower(), "non-creator void is rejected")
err = call_as(c, "0xCREATOR", "void")
check(err is None and c.get_state()["status"] == "voided", "creator can void unsettled market")

# A dispute re-check that is still UNRESOLVED must remain retryable too.
GL.nondet = Nondet(["YES", "UNRESOLVED", "UNRESOLVED"])
c2 = Contract("Dispute retry?", "YES if settled; otherwise UNRESOLVED.", "https://example.com/dispute", "", "", "sim-2")
call_as(c2, "0xCREATOR", "resolve")
check(c2.get_state()["status"] == "resolved", "definitive result enters resolved state")
call_as(c2, "0xOTHER", "dispute", "Please re-check")
check(c2.get_state()["status"] == "disputed", "dispute enters disputed state")
err = call_as(c2, "0xCREATOR", "resolve_dispute")
check(err is None and c2.get_state()["status"] == "disputed", "UNRESOLVED dispute re-check stays retryable")
err = call_as(c2, "0xCREATOR", "resolve_dispute")
check(err is None and c2.get_state()["status"] == "disputed", "retryable disputed re-check can run again")

failed = sum(1 for ok in checks if not ok)
print(f"CHECKS: {len(checks)}  PASSED: {len(checks) - failed}  FAILED: {failed}")
raise SystemExit(1 if failed else 0)
