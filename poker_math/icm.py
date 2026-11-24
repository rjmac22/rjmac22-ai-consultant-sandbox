"""Exact independent chip model (ICM) for small synthetic tournaments.

All stacks are positive integer chip counts, and prize amounts are integer
minor currency units (e.g. pennies). The chip model assumes that at each
finish step, a remaining player's chance to finish next is proportional to
that player's remaining chips. This is a modelling assumption, not a proof
that tournament players follow it.
"""

from fractions import Fraction
from itertools import permutations
from typing import Sequence


def icm_expected_payouts(stacks: Sequence[int], prizes: Sequence[int]) -> tuple[Fraction, ...]:
    """Return each player's exact model-expected prize in input stack order.

    Players who finish below the supplied prize places earn zero. A complete
    finishing order is weighted by successive stack-proportional selections;
    it contributes a payout only after its *entire* probability is calculated.
    Complexity is factorial in the player count, deliberately capped at six.
    """
    chips = tuple(stacks)
    awards = tuple(prizes)
    n = len(chips)
    if not 2 <= n <= 6:
        raise ValueError("provide between two and six players")
    if not chips or any(type(stack) is not int or stack <= 0 for stack in chips):
        raise ValueError("stacks must be positive integer chip counts")
    if not 1 <= len(awards) <= n:
        raise ValueError("provide between one and n prize places")
    if any(type(prize) is not int or prize < 0 for prize in awards):
        raise ValueError("prizes must be nonnegative integer amounts")
    if any(awards[i] < awards[i + 1] for i in range(len(awards) - 1)):
        raise ValueError("prizes must be ordered highest to lowest")

    result = [Fraction(0) for _ in chips]
    total_chips = sum(chips)
    for finish_order in permutations(range(n)):
        probability = Fraction(1)
        remaining = total_chips
        for player in finish_order:
            probability *= Fraction(chips[player], remaining)
            remaining -= chips[player]
        for place, player in enumerate(finish_order[:len(awards)]):
            result[player] += probability * awards[place]
    return tuple(result)
