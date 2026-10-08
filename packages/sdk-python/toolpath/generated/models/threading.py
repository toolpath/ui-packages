from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..models.thread_process import ThreadProcess

if TYPE_CHECKING:
    from ..models.thread_spec import ThreadSpec


T = TypeVar("T", bound="Threading")


@_attrs_define
class Threading:
    """A thread a hole is to receive, and how it is to be cut.

    Attributes:
        spec (ThreadSpec): The thread a hole is to receive.

            Every diameter, the pitch and `threadPercentage` are finite and positive,
            `threadPercentage` at most 100, `minMinorDiameter` no more than `maxMinorDiameter`, and
            `minMajorDiameter` above `minMinorDiameter`; the two angles keep the ranges their fields
            state.
        process (ThreadProcess): How a thread is to be cut: the three ways there are.
    """

    spec: ThreadSpec
    process: ThreadProcess

    def to_dict(self) -> dict[str, Any]:
        spec = self.spec.to_dict()

        process = self.process.value

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "spec": spec,
                "process": process,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.thread_spec import ThreadSpec

        d = dict(src_dict)
        spec = ThreadSpec.from_dict(d.pop("spec"))

        process = ThreadProcess(d.pop("process"))

        threading = cls(
            spec=spec,
            process=process,
        )

        return threading
