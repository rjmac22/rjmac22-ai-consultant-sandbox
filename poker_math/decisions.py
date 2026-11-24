"""Small, synthetic chip-EV utilities. No strategic assumptions or rake model."""

from math import isfinite


def _check_pot(call_cost: float, pot_before_call: float) -> None:
    if not isfinite(call_cost) or not isfinite(pot_before_call):
        raise ValueError("pot and call amounts must be finite")
    if call_cost <= 0:
        raise ValueError("call_cost must be positive")
    if pot_before_call < 0:
        raise ValueError("pot_before_call must not be negative")


def required_equity(call_cost: float, pot_before_call: float) -> float:
    """Break-even pot equity for calling, before rake.

    The pot already includes all chips committed by opponents and the hero,
    but *excludes* the additional chips the hero is about to call. Equity
    includes the expected fraction of the pot won in ties.
    """
    _check_pot(call_cost, pot_before_call)
    return call_cost / (pot_before_call + call_cost)


def call_chip_ev(equity: float, call_cost: float, pot_before_call: float) -> float:
    """Expected incremental chips from a call relative to folding now."""
    _check_pot(call_cost, pot_before_call)
    if not isfinite(equity) or not 0 <= equity <= 1:
        raise ValueError("equity must be a finite probability in [0, 1]")
    return equity * (pot_before_call + call_cost) - call_cost
