"""Probability helpers for simplified card-draw calculations."""


def probability_at_least_one_out(outs: int, unseen: int, draws: int = 1) -> float:
    """Chance of seeing one or more outs in draws without replacement.

    Every unseen card is equally likely to occur at each step; outs are
    assumed to be distinct cards that all count as hits.
    """
    if not all(type(x) is int for x in (outs, unseen, draws)):
        raise ValueError("counts must be integers")
    if unseen < 1 or not 0 <= outs <= unseen or not 1 <= draws <= unseen:
        raise ValueError("counts must describe a nonempty possible draw")
    miss_fraction = (unseen - outs) / unseen
    return 1 - miss_fraction**draws
