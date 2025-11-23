import { A } from '@repo/a';

const ver = '1.0.0'

export const B = `This is a B package ver ${ver}, importing A: ${A}`;
console.log(B)