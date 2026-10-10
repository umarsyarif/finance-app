import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import axios from '@/lib/axios';
import { IconPicker } from './category-icon';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  color: string;
  icon?: string | null;
}

interface CategoryFormProps {
  category?: Category | null;
  onSuccess?: () => void;
}

const COLOR_PRESETS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280', // Gray
];

export function CategoryForm({ category, onSuccess }: CategoryFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE',
    color: '#3B82F6',
    icon: null as string | null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customColor, setCustomColor] = useState('');

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        type: category.type,
        color: category.color,
        icon: category.icon ?? null,
      });
      setCustomColor(category.color);
    }
  }, [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const submitData = {
        ...formData,
        color: customColor || formData.color,
      };

      if (category) {
        await axios.patch(`/api/categories/${category.id}`, submitData);
      } else {
        await axios.post('/api/categories', submitData);
      }
      
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleColorSelect = (color: string) => {
    setFormData(prev => ({ ...prev, color }));
    setCustomColor(color);
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setCustomColor(color);
    setFormData(prev => ({ ...prev, color }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Category Name</Label>
        <Input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Enter category name"
          required
          className="h-[52px] rounded-[20px] bg-card px-[18px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Category Type</Label>
        <Select
          value={formData.type}
          onValueChange={(value: 'INCOME' | 'EXPENSE') => value && setFormData(prev => ({ ...prev, type: value }))}
        >
          <SelectTrigger className="h-[52px] w-full rounded-[20px] bg-card px-[18px]">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INCOME">Income</SelectItem>
            <SelectItem value="EXPENSE">Expense</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Icon</Label>
        <IconPicker value={formData.icon} onChange={(icon) => setFormData(prev => ({ ...prev, icon }))} />
      </div>

      <div className="space-y-2">
        <Label>Category Color</Label>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  (customColor || formData.color) === color
                    ? 'border-foreground scale-110'
                    : 'border-border hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => handleColorSelect(color)}
              />
            ))}
          </div>
          
          <div className="flex items-center space-x-2">
            <Label htmlFor="custom-color" className="text-sm">Custom:</Label>
            <input
              id="custom-color"
              type="color"
              value={customColor || formData.color}
              onChange={handleCustomColorChange}
              className="w-8 h-8 rounded-lg border border-border cursor-pointer"
            />
            <span className="text-sm text-muted-foreground">
              {customColor || formData.color}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2 pt-4">
        <div 
          className="w-4 h-4 rounded-full border" 
          style={{ backgroundColor: customColor || formData.color }}
        />
        <span className="text-sm text-muted-foreground">Preview</span>
      </div>

      <Button type="submit" disabled={isSubmitting} className="h-[52px] w-full rounded-full text-[15px]">
        {isSubmitting ? 'Saving…' : category ? 'Save changes' : 'Create category'}
      </Button>
    </form>
  );
}