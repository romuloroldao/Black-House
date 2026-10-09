import { useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import { getEffectivePose, type EvolutionPhoto } from '@/lib/evolution-timeline';
import { isAutomaticPoseSource } from '@/lib/evolution-timeline-pose';
import { tEvolution } from '@/i18n/evolution-photos';
import { toast } from 'sonner';

const COACH_POSE_OPTIONS = [
  { value: 'frente', labelKey: 'front' as const },
  { value: 'costas', labelKey: 'back' as const },
  { value: 'lado_esquerdo', labelKey: 'leftSide' as const },
  { value: 'lado_direito', labelKey: 'rightSide' as const },
  { value: 'desconhecido', labelKey: 'unknownPose' as const },
  { value: 'invalido', labelKey: 'invalidPose' as const },
];

type Props = {
  photo: EvolutionPhoto;
  onUpdated?: () => void;
};

export function PhotoPoseCoachActions({ photo, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);

  const effective = getEffectivePose(photo);
  const isCoachCorrected = photo.pose_source === 'coach' || Boolean(photo.pose_coach);
  const isAuto = isAutomaticPoseSource(effective.source) && !isCoachCorrected;

  const openDialog = () => {
    setSelected(effective.pose || 'frente');
    setOpen(true);
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const result = await apiClient.updatePhotoPoseSafe(photo.id, selected);
      if (!result.success) {
        toast.error(result.error || tEvolution('poseUpdateFailed'));
        return;
      }
      toast.success(tEvolution('poseUpdated'));
      setOpen(false);
      onUpdated?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isCoachCorrected ? (
        <Badge variant="secondary">{tEvolution('poseCorrectedByCoach')}</Badge>
      ) : isAuto ? (
        <Badge variant="outline">{tEvolution('poseIdentifiedAutomatically')}</Badge>
      ) : photo.pose_analysis_status === 'pending' || photo.pose_analysis_status === 'processing' ? (
        <Badge variant="outline" className="gap-1">
          <Loader2 className="h-3 w-3 motion-safe:animate-spin" />
          {tEvolution('classifyingPose')}
        </Badge>
      ) : null}

      <Button type="button" variant="outline" size="sm" className="gap-1" onClick={openDialog}>
        <Pencil className="h-3.5 w-3.5" />
        {tEvolution('correctPose')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tEvolution('correctPoseTitle')}</DialogTitle>
            <DialogDescription>{tEvolution('correctPoseDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="coach-pose-select">{tEvolution('pose')}</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger id="coach-pose-select">
                <SelectValue placeholder={tEvolution('pose')} />
              </SelectTrigger>
              <SelectContent>
                {COACH_POSE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {tEvolution(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              {tEvolution('close')}
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving || !selected}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" /> : null}
              {tEvolution('savePose')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
