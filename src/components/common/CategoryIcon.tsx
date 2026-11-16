import React from 'react';
import { 
  Scissors, 
  Sparkles, 
  Zap, 
  Wrench, 
  Hammer, 
  Axe, 
  Paintbrush, 
  UserCheck, 
  BookOpen, 
  Utensils, 
  ShieldCheck,
  Briefcase
} from 'lucide-react';

interface Props {
  iconName: string;
  className?: string;
}

export const CategoryIcon: React.FC<Props> = ({ iconName, className = 'w-5 h-5' }) => {
  switch (iconName) {
    case 'Scissors':
      return <Scissors className={className} />;
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'Zap':
      return <Zap className={className} />;
    case 'Wrench':
      return <Wrench className={className} />;
    case 'Hammer':
      return <Hammer className={className} />;
    case 'Axe':
      return <Axe className={className} />;
    case 'Paintbrush':
      return <Paintbrush className={className} />;
    case 'UserCheck':
      return <UserCheck className={className} />;
    case 'BookOpen':
      return <BookOpen className={className} />;
    case 'Utensils':
      return <Utensils className={className} />;
    case 'ShieldCheck':
      return <ShieldCheck className={className} />;
    default:
      return <Briefcase className={className} />;
  }
};
