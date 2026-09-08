'use client';
import {useEffect} from 'react';
import {initializeThemes} from './theme-engine';
export default function ThemeBehavior(){useEffect(initializeThemes,[]);return null}
