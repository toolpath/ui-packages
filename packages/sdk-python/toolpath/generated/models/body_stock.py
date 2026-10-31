from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..models.body_stock_mode import BodyStockMode

T = TypeVar("T", bound="BodyStock")


@_attrs_define
class BodyStock:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    Another solid body of the part’s own file, taken where it lies — a casting, a forging, or what an earlier operation
    left — never sized or squared up. The part must stand inside it, or the job fails. Regions of the part the body
    already leaves at their final surface are skipped: no setup machines them. Only a part made from a file can be cut
    from one.

        Attributes:
            mode (BodyStockMode): Another body of the part’s own file.
            body_index (int): The stock body’s index among the part’s file’s `bodies`: one that exists, and not the part’s
                own.
    """

    mode: BodyStockMode
    body_index: int

    def to_dict(self) -> dict[str, Any]:
        mode = self.mode.value

        body_index = self.body_index

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "mode": mode,
                "bodyIndex": body_index,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        mode = BodyStockMode(d.pop("mode"))

        body_index = d.pop("bodyIndex")

        body_stock = cls(
            mode=mode,
            body_index=body_index,
        )

        return body_stock
